"""
Job Scraper Service
Handles scraping job postings from multiple platforms using JobSpy
and storing them in Supabase with deduplication and processing
"""

import logging
import json
import hashlib
import random
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import pandas as pd
from jobspy import scrape_jobs
from .database import DatabaseManager
from .supabase_manager import SupabaseDatabaseManager
from config.database_config import db_config
import re

logger = logging.getLogger(__name__)

class JobScrapingService:
    """Service for scraping and managing job postings"""
    
    def __init__(self):
        # Initialize database manager
        if db_config.is_postgresql():
            self.db_manager = SupabaseDatabaseManager()
        else:
            self.db_manager = DatabaseManager()
            
        # Scraping configuration for software engineering roles
        self.default_config = {
            "search_term": "software engineer",
            "location": "United States",
            "distance": 50,
            "job_type": None,  # All job types
            "is_remote": False,  # Set to False to get both remote and on-site
            "results_wanted": 100,
            "easy_apply": None,
            "description_format": "html",  # JobSpy expects 'html' or 'markdown'
            # Add modern user agent to avoid 403 errors
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        # Platform configuration - prioritize working platforms
        # Glassdoor currently has aggressive bot detection (403 errors)
        self.active_platforms = ["indeed", "linkedin"]
        self.problematic_platforms = ["glassdoor", "zip_recruiter"]  # Known to have bot detection/rate limit issues
        
        # Dynamic user agent pool - fetched from external source
        self.user_agents = []
        self.user_agents_url = "https://jnrbsn.github.io/user-agents/user-agents.json"
        self.user_agents_cache_duration = 3600  # 1 hour cache
        self.last_user_agents_fetch = None
        
        # Fallback static user agents in case dynamic fetch fails
        self.fallback_user_agents = [
            # Chrome on Windows
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            # Chrome on macOS
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            # Safari on macOS
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
            # Firefox on Windows
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
            # Edge on Windows
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
        ]
        
        # Initialize user agents on startup
        self._refresh_user_agents()
        
        # Proxy configuration (optional for avoiding rate limits)
        self.proxies = []  # Add proxies here if needed: ['http://proxy1:port', 'http://proxy2:port']
        self.use_proxies = len(self.proxies) > 0
        
        # Skill extraction patterns
        self.skill_patterns = [
            r'\b(?:JavaScript|TypeScript|Python|Java|C\+\+|C#|Go|Rust|Swift|Kotlin)\b',
            r'\b(?:React|Angular|Vue|Node\.js|Express|Django|Flask|Spring|Laravel)\b',
            r'\b(?:AWS|Azure|GCP|Docker|Kubernetes|Jenkins|Git|GraphQL|REST)\b',
            r'\b(?:PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch|Cassandra)\b',
            r'\b(?:Machine Learning|AI|Data Science|DevOps|Microservices|Agile|Scrum)\b'
        ]
    
    def _refresh_user_agents(self) -> None:
        """Fetch latest user agents from external source"""
        try:
            # Check if we need to refresh (cache expired or no agents)
            current_time = datetime.now()
            if (self.last_user_agents_fetch and 
                (current_time - self.last_user_agents_fetch).total_seconds() < self.user_agents_cache_duration and
                self.user_agents):
                return  # Cache is still valid
            
            logger.info(f"Fetching fresh user agents from {self.user_agents_url}")
            
            # Fetch user agents with timeout
            response = requests.get(self.user_agents_url, timeout=10)
            response.raise_for_status()
            
            fresh_user_agents = response.json()
            
            if fresh_user_agents and len(fresh_user_agents) > 0:
                self.user_agents = fresh_user_agents
                self.last_user_agents_fetch = current_time
                logger.info(f"✅ Successfully fetched {len(self.user_agents)} fresh user agents")
            else:
                raise ValueError("Empty user agents list received")
                
        except Exception as e:
            logger.warning(f"Failed to fetch fresh user agents: {e}. Using fallback agents.")
            if not self.user_agents:  # Only use fallback if we have no agents at all
                self.user_agents = self.fallback_user_agents
                logger.info(f"Using {len(self.user_agents)} fallback user agents")
    
    def _get_random_user_agent(self) -> str:
        """Get a random user agent to avoid detection"""
        # Refresh user agents if needed
        self._refresh_user_agents()
        
        # Return random user agent from current pool
        if self.user_agents:
            return random.choice(self.user_agents)
        else:
            # Final fallback
            return self.fallback_user_agents[0]
    
    def _get_random_proxy(self):
        """Get a random proxy if available"""
        if self.use_proxies and self.proxies:
            return random.choice(self.proxies)
        return None
    
    def scrape_jobs_for_software_engineering(
        self, 
        custom_config: Optional[Dict[str, Any]] = None,
        target_platforms: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Scrape software engineering jobs from multiple platforms
        
        Args:
            custom_config: Override default scraping configuration
            target_platforms: Specific platforms to scrape
            
        Returns:
            Dictionary with scraping results and statistics
        """
        config = {**self.default_config, **(custom_config or {})}
        platforms = target_platforms or self.active_platforms
        
        logger.info(f"Starting job scraping for platforms: {platforms}")
        logger.info(f"Search config: {config}")
        
        results = {
            "total_scraped": 0,
            "total_new": 0,
            "total_updated": 0,
            "platform_results": {},
            "errors": []
        }
        
        for platform in platforms:
            try:
                platform_result = self._scrape_platform(platform, config)
                results["platform_results"][platform] = platform_result
                results["total_scraped"] += platform_result["scraped"]
                results["total_new"] += platform_result["new_jobs"]
                results["total_updated"] += platform_result["updated_jobs"]
                
                logger.info(f"Platform {platform}: {platform_result}")
                
            except Exception as e:
                error_msg = f"Error scraping {platform}: {str(e)}"
                logger.error(error_msg)
                results["errors"].append(error_msg)
        
        logger.info(f"Scraping completed. Results: {results}")
        return results
    
    def _scrape_platform(self, platform: str, config: Dict[str, Any]) -> Dict[str, int]:
        """Scrape jobs from a specific platform"""
        
        try:
            # Add platform-specific configurations
            scrape_config = config.copy()
            
            # Use random user agent for each platform to avoid detection
            scrape_config["user_agent"] = self._get_random_user_agent()
            
            # Use random proxy if available
            selected_proxy = self._get_random_proxy()
            if selected_proxy:
                scrape_config["proxies"] = [selected_proxy]
                logger.info(f"Using proxy for {platform}: {selected_proxy}")
            
            # Add delays for problematic platforms
            if platform in self.problematic_platforms:
                logger.info(f"Using careful approach for {platform} due to bot detection")
                scrape_config["results_wanted"] = min(scrape_config["results_wanted"], 20)  # Reduce load
                logger.info(f"Using user agent for {platform}: {scrape_config['user_agent'][:50]}...")
            
            # Perform scraping using JobSpy
            df = scrape_jobs(
                site_name=[platform],
                search_term=scrape_config["search_term"],
                location=scrape_config["location"],
                distance=scrape_config.get("distance", 50),
                job_type=scrape_config.get("job_type"),
                is_remote=scrape_config.get("is_remote"),
                results_wanted=scrape_config["results_wanted"],
                easy_apply=scrape_config.get("easy_apply"),
                description_format=scrape_config["description_format"],
                user_agent=scrape_config.get("user_agent"),
                proxies=scrape_config.get("proxies")
            )
            
            if df is None or df.empty:
                logger.warning(f"No jobs scraped from {platform}")
                return {"scraped": 0, "new_jobs": 0, "updated_jobs": 0}
            
            # Process and store jobs
            new_jobs = 0
            updated_jobs = 0
            
            for _, job_row in df.iterrows():
                job_data = self._process_job_data(job_row, platform)
                
                if self._store_job(job_data):
                    new_jobs += 1
                else:
                    updated_jobs += 1
            
            return {
                "scraped": len(df),
                "new_jobs": new_jobs,
                "updated_jobs": updated_jobs
            }
            
        except Exception as e:
            logger.error(f"Failed to scrape {platform}: {e}")
            raise
    
    def _process_job_data(self, job_row: pd.Series, platform: str) -> Dict[str, Any]:
        """Process raw job data into standardized format"""
        
        # Generate unique job ID based on title, company, and platform
        job_id_raw = f"{job_row.get('title', '')}-{job_row.get('company', '')}-{platform}"
        job_id = hashlib.md5(job_id_raw.encode()).hexdigest()
        
        # Extract salary information
        salary_min, salary_max = self._extract_salary(job_row)
        
        # Extract skills from description
        skills = self._extract_skills(job_row.get('description', ''))
        
        # Determine experience level
        experience_level = self._determine_experience_level(
            job_row.get('title', ''), 
            job_row.get('description', '')
        )
        
        # Process location and remote status
        location, is_remote = self._process_location(job_row.get('location', ''))
        
        return {
            "job_id": job_id,
            "title": str(job_row.get('title', '')).strip(),
            "company": str(job_row.get('company', '')).strip(),
            "location": location,
            "remote": is_remote or job_row.get('is_remote', False),
            "job_type": self._standardize_job_type(job_row.get('job_type')),
            "salary_min": salary_min,
            "salary_max": salary_max,
            "salary_currency": "USD",  # Default for US jobs
            "description": self._clean_description(job_row.get('description', '')),
            "requirements": self._extract_requirements(job_row.get('description', '')),
            "benefits": self._extract_benefits(job_row.get('description', '')),
            "application_url": job_row.get('job_url', ''),
            "company_logo_url": job_row.get('company_logo', ''),
            "platform": platform,
            "date_posted": self._parse_date(job_row.get('date_posted')),
            "skills": skills,
            "experience_level": experience_level,
            "is_active": True
        }
    
    def _extract_salary(self, job_row: pd.Series) -> tuple[Optional[int], Optional[int]]:
        """Extract salary range from job data"""
        
        salary_text = ""
        
        # Check various salary fields
        for field in ['salary', 'compensation', 'min_amount', 'max_amount']:
            if pd.notna(job_row.get(field)):
                salary_text += str(job_row[field]) + " "
        
        if not salary_text.strip():
            return None, None
        
        # Extract salary numbers using regex
        salary_numbers = re.findall(r'\$?([\d,]+)k?', salary_text.replace(',', ''))
        
        if len(salary_numbers) >= 2:
            try:
                min_sal = int(salary_numbers[0].replace(',', ''))
                max_sal = int(salary_numbers[1].replace(',', ''))
                
                # Handle 'k' suffix (thousands)
                if 'k' in salary_text.lower():
                    min_sal *= 1000
                    max_sal *= 1000
                
                return min_sal, max_sal
            except ValueError:
                pass
        
        elif len(salary_numbers) == 1:
            try:
                salary = int(salary_numbers[0].replace(',', ''))
                if 'k' in salary_text.lower():
                    salary *= 1000
                return salary, salary
            except ValueError:
                pass
        
        return None, None
    
    def _extract_skills(self, description: str) -> List[str]:
        """Extract technical skills from job description"""
        
        if not description:
            return []
        
        skills = set()
        
        for pattern in self.skill_patterns:
            matches = re.findall(pattern, description, re.IGNORECASE)
            skills.update(matches)
        
        return list(skills)[:20]  # Limit to top 20 skills
    
    def _determine_experience_level(self, title: str, description: str) -> str:
        """Determine experience level from title and description"""
        
        text = f"{title} {description}".lower()
        
        if any(term in text for term in ['senior', 'sr.', 'lead', 'principal', 'staff', 'architect']):
            return 'senior'
        elif any(term in text for term in ['junior', 'jr.', 'entry', 'graduate', 'new grad', 'intern']):
            return 'entry'
        else:
            return 'mid'
    
    def _process_location(self, location) -> tuple[str, bool]:
        """Process location and determine remote status"""
        
        if not location:
            return "", False
        
        location = str(location).strip()
        is_remote = any(term in location.lower() for term in ['remote', 'work from home', 'wfh', 'anywhere'])
        
        # Clean up location string
        location = re.sub(r'\b(remote|work from home|wfh)\b', '', location, flags=re.IGNORECASE).strip()
        location = re.sub(r'\s+', ' ', location)  # Remove extra spaces
        
        return location, is_remote
    
    def _standardize_job_type(self, job_type: Any) -> str:
        """Standardize job type to consistent values"""
        
        if not job_type:
            return "full-time"  # Default
        
        job_type_str = str(job_type).lower().strip()
        
        if 'full' in job_type_str or 'permanent' in job_type_str:
            return "full-time"
        elif 'part' in job_type_str:
            return "part-time"
        elif 'contract' in job_type_str or 'freelance' in job_type_str:
            return "contract"
        elif 'intern' in job_type_str:
            return "internship"
        elif 'temp' in job_type_str:
            return "temporary"
        else:
            return "full-time"
    
    def _clean_description(self, description: str) -> str:
        """Clean and format job description"""
        
        if not description:
            return ""
        
        # Remove excessive whitespace
        description = re.sub(r'\s+', ' ', description)
        
        # Remove HTML tags if present
        description = re.sub(r'<[^>]+>', '', description)
        
        # Truncate to reasonable length
        return description[:5000].strip()
    
    def _extract_requirements(self, description: str) -> str:
        """Extract requirements section from job description"""
        
        if not description:
            return ""
        
        # Look for requirements section
        requirements_match = re.search(
            r'(?:requirements?|qualifications?|must have|needed):(.+?)(?:responsibilities?|benefits?|about|$)',
            description,
            re.IGNORECASE | re.DOTALL
        )
        
        if requirements_match:
            return requirements_match.group(1).strip()[:2000]
        
        return ""
    
    def _extract_benefits(self, description: str) -> str:
        """Extract benefits section from job description"""
        
        if not description:
            return ""
        
        # Look for benefits section
        benefits_match = re.search(
            r'(?:benefits?|perks?|we offer):(.+?)(?:requirements?|responsibilities?|about|$)',
            description,
            re.IGNORECASE | re.DOTALL
        )
        
        if benefits_match:
            return benefits_match.group(1).strip()[:1000]
        
        return ""
    
    def _parse_date(self, date_value: Any) -> Optional[datetime]:
        """Parse date from various formats"""
        
        if pd.isna(date_value):
            return None
        
        if isinstance(date_value, datetime):
            return date_value
        
        if isinstance(date_value, str):
            try:
                # Try common date formats
                from dateutil import parser
                return parser.parse(date_value)
            except:
                pass
        
        return None
    
    def _store_job(self, job_data: Dict[str, Any]) -> bool:
        """
        Store job in database with deduplication
        
        Returns:
            True if new job was inserted, False if existing job was updated
        """
        
        try:
            # Check if job already exists
            existing_job = self.db_manager.execute_query(
                "SELECT id, updated_at FROM jobs WHERE job_id = %s",
                (job_data["job_id"],)
            )
            
            if existing_job:
                # Update existing job
                update_query = """
                UPDATE jobs SET 
                    title = %s, company = %s, location = %s, remote = %s,
                    job_type = %s, salary_min = %s, salary_max = %s,
                    description = %s, requirements = %s, benefits = %s,
                    application_url = %s, skills = %s, experience_level = %s,
                    updated_at = NOW()
                WHERE job_id = %s
                """
                
                self.db_manager.execute_query(update_query, (
                    job_data["title"], job_data["company"], job_data["location"],
                    job_data["remote"], job_data["job_type"], job_data["salary_min"],
                    job_data["salary_max"], job_data["description"], job_data["requirements"],
                    job_data["benefits"], job_data["application_url"], job_data["skills"],
                    job_data["experience_level"], job_data["job_id"]
                ))
                
                return False  # Updated existing
            
            else:
                # Insert new job
                insert_query = """
                INSERT INTO jobs (
                    job_id, title, company, location, remote, job_type,
                    salary_min, salary_max, salary_currency, description,
                    requirements, benefits, application_url, company_logo_url,
                    platform, date_posted, skills, experience_level, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                self.db_manager.execute_query(insert_query, (
                    job_data["job_id"], job_data["title"], job_data["company"],
                    job_data["location"], job_data["remote"], job_data["job_type"],
                    job_data["salary_min"], job_data["salary_max"], job_data["salary_currency"],
                    job_data["description"], job_data["requirements"], job_data["benefits"],
                    job_data["application_url"], job_data["company_logo_url"],
                    job_data["platform"], job_data["date_posted"], job_data["skills"],
                    job_data["experience_level"], job_data["is_active"]
                ))
                
                return True  # New job inserted
                
        except Exception as e:
            logger.error(f"Error storing job {job_data.get('job_id')}: {e}")
            return False
    
    def get_scraping_statistics(self) -> Dict[str, Any]:
        """Get statistics about scraped jobs"""
        
        try:
            stats_query = """
            SELECT 
                COUNT(*) as total_jobs,
                COUNT(*) FILTER (WHERE date_posted >= NOW() - INTERVAL '24 hours') as jobs_last_24h,
                COUNT(*) FILTER (WHERE date_posted >= NOW() - INTERVAL '7 days') as jobs_last_week,
                COUNT(*) FILTER (WHERE remote = true) as remote_jobs,
                platform,
                COUNT(*) as platform_count
            FROM jobs 
            WHERE is_active = true
            GROUP BY platform
            ORDER BY platform_count DESC
            """
            
            results = self.db_manager.execute_query(stats_query)
            
            return {
                "platform_stats": results,
                "last_scrape": self._get_last_scrape_time()
            }
            
        except Exception as e:
            logger.error(f"Error getting scraping statistics: {e}")
            return {"platform_stats": [], "last_scrape": None}
    
    def _get_last_scrape_time(self) -> Optional[datetime]:
        """Get the timestamp of the last scraping operation"""
        
        try:
            result = self.db_manager.execute_query(
                "SELECT MAX(scraped_at) as last_scrape FROM jobs"
            )
            
            if result and result[0]["last_scrape"]:
                return result[0]["last_scrape"]
            
        except Exception as e:
            logger.error(f"Error getting last scrape time: {e}")
        
        return None
    
    def cleanup_old_jobs(self, days_to_keep: int = 30) -> int:
        """Remove old job postings to keep database clean"""
        
        try:
            cleanup_query = """
            DELETE FROM jobs 
            WHERE scraped_at < NOW() - INTERVAL '%s days'
            AND is_active = false
            """
            
            result = self.db_manager.execute_query(cleanup_query, (days_to_keep,))
            
            # Get count of deleted rows (implementation depends on DB manager)
            deleted_count = getattr(result, 'rowcount', 0) if result else 0
            
            logger.info(f"Cleaned up {deleted_count} old job postings")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error during job cleanup: {e}")
            return 0