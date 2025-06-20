"""
Simple Resume Tailoring Service
No-nonsense resume generation for personal use
"""

import json
import logging
import os
from typing import Dict, Any, Tuple
from services.llm_factory import LLMFactory
from services.resume.resume_parser import ResumeParser

logger = logging.getLogger(__name__)

class SimpleResumeTailor:
    """Simple but effective resume tailoring for personal use"""
    
    def __init__(self):
        self.llm_service = None  # Lazy-loaded when needed
        
    def tailor_resume_complete(self, job_description: str, company: str, role: str, base_resume: Dict[str, Any] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Generate complete tailored resume in one step
        
        Args:
            job_description: The job posting text
            company: Company name
            role: Job title
            base_resume: Optional base resume data (uses default if not provided)
            
        Returns:
            Tuple of (tailored_resume, insights)
        """
        
        # Use base resume profile if none provided
        if not base_resume:
            base_resume = self._get_base_resume_profile()
        
        try:
            # Generate complete tailored resume
            tailored_content = self._generate_tailored_content(
                job_description, company, role, base_resume
            )
            
            # Extract insights
            insights = self._generate_insights(
                job_description, base_resume, tailored_content
            )
            
            return tailored_content, insights
            
        except Exception as e:
            logger.error(f"Error in resume tailoring: {e}")
            raise
    
    def _get_llm_service(self):
        """Lazy-load the LLM service when needed"""
        if self.llm_service is None:
            self.llm_service = LLMFactory.create_service('openai')
        return self.llm_service
    
    def _generate_tailored_content(self, job_description: str, company: str, role: str, base_resume: Dict[str, Any]) -> Dict[str, Any]:
        """Generate the complete tailored resume content"""
        
        prompt = f"""
        You are an expert resume writer specializing in ATS-optimized resumes. 
        Tailor this resume for the specific job posting.

        TARGET JOB:
        Company: {company}
        Role: {role}
        Job Description: {job_description}

        CURRENT RESUME PROFILE:
        {json.dumps(base_resume, indent=2)}

        INSTRUCTIONS:
        1. Create a complete, tailored resume optimized for this specific job
        2. Keep the same professional structure and format
        3. Optimize the summary to directly address job requirements
        4. Emphasize relevant experiences and achievements
        5. Integrate keywords naturally (no keyword stuffing)
        6. Quantify achievements with specific metrics where possible
        7. Ensure ATS-friendly formatting and keyword density
        8. Make it compelling and human-readable

        CRITICAL: Return ONLY a JSON object with this exact structure:
        {{
            "summary": "tailored professional summary",
            "experience": [
                {{
                    "title": "job title",
                    "company": "company name", 
                    "duration": "time period",
                    "achievements": ["achievement 1", "achievement 2", "achievement 3"]
                }}
            ],
            "skills": {{
                "technical": ["skill1", "skill2"],
                "languages": ["lang1", "lang2"], 
                "frameworks": ["framework1", "framework2"],
                "tools": ["tool1", "tool2"]
            }},
            "education": [
                {{
                    "degree": "degree name",
                    "institution": "school name",
                    "year": "graduation year"
                }}
            ]
        }}

        Return only the JSON, no additional text or formatting.
        """
        
        # Use the LLM service correctly for content generation
        try:
            llm = self._get_llm_service()
            response = llm.generate_content(prompt)
            
            if not response:
                raise Exception("No response from LLM service")
                
        except Exception as e:
            logger.warning(f"LLM service failed, using fallback: {e}")
            # Fallback to direct OpenAI if available
            try:
                import openai
                import os
                
                client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.7
                )
                response_content = response.choices[0].message.content
                
            except Exception as e2:
                logger.error(f"All LLM services failed: {e2}")
                # Return a properly structured fallback
                return self._create_fallback_resume(base_resume, job_description, company, role)
        
        try:
            # Parse the JSON response
            if hasattr(response, 'content'):
                response_content = response.content
            else:
                response_content = str(response)
                
            tailored_data = json.loads(response_content)
            return tailored_data
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM response as JSON: {e}")
            logger.error(f"Raw response: {response_content}")
            # Return fallback instead of crashing
            return self._create_fallback_resume(base_resume, job_description, company, role)
    
    def _generate_insights(self, job_description: str, base_resume: Dict[str, Any], tailored_resume: Dict[str, Any]) -> Dict[str, Any]:
        """Generate simple insights about the changes made"""
        
        # Calculate keyword coverage
        keyword_coverage = self._calculate_keyword_coverage(job_description, tailored_resume)
        
        # Simple analysis of changes
        jd_lower = job_description.lower()
        
        # Find keywords that were likely added/emphasized
        keywords_added = []
        emphasis_areas = []
        
        if 'python' in jd_lower:
            keywords_added.append('Python')
            emphasis_areas.append('Programming Languages')
        if 'react' in jd_lower:
            keywords_added.append('React')
            emphasis_areas.append('Frontend Development')
        if 'aws' in jd_lower or 'cloud' in jd_lower:
            keywords_added.append('AWS/Cloud')
            emphasis_areas.append('Cloud Technologies')
        if 'microservices' in jd_lower:
            keywords_added.append('Microservices')
            emphasis_areas.append('System Architecture')
        if 'leadership' in jd_lower or 'team' in jd_lower:
            keywords_added.append('Team Leadership')
            emphasis_areas.append('Leadership Experience')
        if 'agile' in jd_lower or 'scrum' in jd_lower:
            keywords_added.append('Agile/Scrum')
            emphasis_areas.append('Development Methodologies')
            
        # Determine match strength based on coverage
        if keyword_coverage >= 80:
            match_strength = "High"
        elif keyword_coverage >= 60:
            match_strength = "Medium"
        else:
            match_strength = "Low"
            
        changes_made = f"Optimized resume for {tailored_resume.get('experience', [{}])[0].get('title', 'target role')} position by emphasizing relevant technical skills and experience"
        
        if keywords_added:
            changes_made += f". Highlighted {', '.join(keywords_added[:3])} expertise to match job requirements"
            
        return {
            "changes_made": changes_made,
            "keywords_added": keywords_added[:5],  # Limit to 5 keywords
            "emphasis_areas": emphasis_areas[:4],  # Limit to 4 areas
            "match_strength": match_strength,
            "keyword_coverage": keyword_coverage,
            "ready_to_apply": match_strength in ["High", "Medium"],
            "recommendations": [
                "Review the tailored summary section",
                "Export as PDF for applications",
                "Consider customizing for specific departments" if match_strength == "Medium" else "Strong match - ready to apply"
            ]
        }
    
    def _calculate_keyword_coverage(self, job_description: str, tailored_resume: Dict[str, Any]) -> int:
        """Calculate keyword coverage using accurate word boundary matching"""
        import re
        
        # Extract common technical keywords from job description
        jd_lower = job_description.lower()
        resume_text = json.dumps(tailored_resume).lower()
        
        # Common technical keywords to check
        tech_keywords = [
            'python', 'javascript', 'react', 'node', 'aws', 'docker', 'kubernetes',
            'microservices', 'api', 'database', 'sql', 'nosql', 'mongodb', 'redis',
            'git', 'ci/cd', 'agile', 'scrum', 'leadership', 'team', 'scalable',
            'cloud', 'architecture', 'backend', 'frontend', 'fullstack', 'devops'
        ]
        
        # Use word boundaries for accurate matching
        jd_keywords = []
        for kw in tech_keywords:
            # Escape special regex characters in keyword
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, jd_lower):
                jd_keywords.append(kw)
        
        matched_keywords = []
        for kw in jd_keywords:
            pattern = r'\b' + re.escape(kw) + r'\b'
            if re.search(pattern, resume_text):
                matched_keywords.append(kw)
        
        if not jd_keywords:
            return 85  # Default good score
            
        coverage = int((len(matched_keywords) / len(jd_keywords)) * 100)
        return min(coverage, 95)  # Cap at 95% to be realistic
    
    def _create_fallback_resume(self, base_resume: Dict[str, Any], job_description: str, company: str, role: str) -> Dict[str, Any]:
        """Create a fallback tailored resume when LLM services fail"""
        
        # Extract some keywords from job description for basic tailoring
        jd_lower = job_description.lower()
        
        # Simple keyword matching
        tech_keywords = []
        if 'python' in jd_lower:
            tech_keywords.append('Python')
        if 'react' in jd_lower:
            tech_keywords.append('React')
        if 'aws' in jd_lower or 'cloud' in jd_lower:
            tech_keywords.append('AWS')
        if 'microservices' in jd_lower:
            tech_keywords.append('Microservices')
        if 'leadership' in jd_lower or 'team' in jd_lower:
            tech_keywords.append('Team Leadership')
            
        # Create tailored summary
        tailored_summary = f"Experienced {role} with expertise in {', '.join(tech_keywords[:3])} and scalable system design. Proven track record in building high-performance applications and leading technical initiatives."
        
        # Use base resume as template but with some customization
        tailored = base_resume.copy()
        tailored['summary'] = tailored_summary
        
        # Add relevant keywords to skills if not already present
        for keyword in tech_keywords:
            if keyword not in tailored['skills']['technical']:
                tailored['skills']['technical'].append(keyword)
                
        return tailored

    def _get_base_resume_profile(self) -> Dict[str, Any]:
        """Get the base resume profile using ResumeParser"""
        try:
            # Get absolute path to data directory
            current_dir = os.path.dirname(os.path.abspath(__file__))
            data_dir = os.path.join(current_dir, "..", "data")
            data_dir_abs = os.path.abspath(data_dir)
            
            logger.info(f"Loading resume data from: {data_dir_abs}")
            
            parser = ResumeParser(data_dir=data_dir_abs)
            base_content = parser.get_base_resume_content()
            
            # Convert ResumeParser format to SimpleResumeTailor format
            return self._convert_parser_to_tailor_format(base_content)
        except Exception as e:
            logger.error(f"Failed to load actual resume data. See traceback for details.", exc_info=True)
            # Fallback to hardcoded data as last resort
            return self._get_fallback_resume_profile()
    
    
    def _convert_parser_to_tailor_format(self, parser_data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert ResumeParser data format to SimpleResumeTailor expected format"""
        
        # Extract experiences from raw_experiences
        experiences = []
        if parser_data.get("raw_experiences"):
            for exp in parser_data["raw_experiences"][:3]:  # Top 3 experiences
                experience_entry = {
                    "title": exp.get("job_title", ""),
                    "company": exp.get("company_name", ""),
                    "duration": exp.get("dates", "").replace("[", "").replace("]", ""),
                    "achievements": exp.get("experience_highlights", [])[:4]  # Top 4 bullets
                }
                experiences.append(experience_entry)
        
        # Extract skills from raw_profile
        skills = {
            "technical": [],
            "languages": [],
            "frameworks": [],
            "tools": []
        }
        
        if parser_data.get("raw_profile"):
            profile = parser_data["raw_profile"]
            skills["languages"] = profile.get("programming_languages", [])
            skills["frameworks"] = profile.get("frameworks_libraries_tools", [])[:8]  # Limit length
            skills["tools"] = profile.get("cloud_devops_tools", [])[:8]  # Limit length
            skills["technical"] = (
                profile.get("programming_languages", []) + 
                profile.get("databases", [])[:4] +
                profile.get("architecture_design_concepts", [])[:4]
            )
        
        return {
            "summary": parser_data.get("summary", "Experienced Software Engineer with expertise in full-stack development and scalable system design."),
            "experience": experiences,
            "skills": skills,
            "education": [
                {
                    "degree": "Bachelor of Technology in Computer Science", 
                    "institution": "University",
                    "year": "2018"
                }
            ]
        }
    
    def _get_fallback_resume_profile(self) -> Dict[str, Any]:
        """Fallback hardcoded resume data if ResumeParser fails"""
        logger.warning("Using fallback resume data - actual resume not loaded")
        
        return {
            "summary": "Experienced Software Engineer with expertise in full-stack development, cloud architecture, and scalable system design. Proven track record in building microservices, implementing payment integrations, and leading technical initiatives.",
            "experience": [
                {
                    "title": "Senior Software Engineer",
                    "company": "Previous Company",
                    "duration": "2020 - Present",
                    "achievements": [
                        "Built and maintained scalable web applications serving 10k+ users",
                        "Implemented microservices architecture reducing system latency by 40%",
                        "Led development of payment integration systems",
                        "Mentored junior developers and contributed to technical decision-making"
                    ]
                }
            ],
            "skills": {
                "technical": ["Python", "JavaScript", "Node.js", "React", "SQL", "NoSQL"],
                "languages": ["Python", "JavaScript", "Go", "Java"],
                "frameworks": ["React", "Node.js", "Express", "Django", "FastAPI"],
                "tools": ["AWS", "Docker", "Kubernetes", "Git", "MongoDB", "PostgreSQL"]
            },
            "education": [
                {
                    "degree": "Bachelor of Technology in Computer Science",
                    "institution": "University Name",
                    "year": "2018"
                }
            ]
        }