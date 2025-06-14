#!/usr/bin/env python3
"""
Enhanced Job Scraper with Anti-Detection
Implements advanced scraping strategies with resilience and stealth
"""

import os
import json
import logging
import random
import time
import threading
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import requests
from jobspy import scrape_jobs
import pandas as pd
from .database import DatabaseManager
from .supabase_manager import SupabaseDatabaseManager
from .enhanced_job_processor import EnhancedJobProcessor
from .stealth_scraper import try_stealth_scrape, StealthJobScraper
from config.database_config import db_config

logger = logging.getLogger(__name__)

class EnhancedJobScrapingService:
    """
    Enhanced job scraper with anti-detection and resilient architecture
    Features:
    - Individual job processing with error isolation
    - Advanced user agent rotation
    - Intelligent rate limiting
    - Background processing with status tracking
    - Direct API discovery for some platforms
    """
    
    def __init__(self):
        # Initialize database manager
        if db_config.is_postgresql():
            self.db_manager = SupabaseDatabaseManager()
        else:
            self.db_manager = DatabaseManager()
            
        # Initialize enhanced processor
        self.enhanced_processor = EnhancedJobProcessor()
            
        # Enhanced scraping configuration
        self.config = {
            "search_terms": [
                "software engineer",
                "backend engineer", 
                "full stack developer",
                "python developer",
                "senior software engineer"
            ],
            "locations": [
                "United States",
                "Remote USA",
                "New York, NY",
                "San Francisco, CA", 
                "Seattle, WA",
                "Austin, TX"
            ],
            "distance": 50,
            "results_per_search": 30,  # Smaller batches to avoid detection
            "is_remote": True,
            "easy_apply": None,
            "description_format": "html"
        }
        
        # Platform configuration with reliability scores
        self.platforms = {
            "indeed": {
                "active": True,
                "reliability": 0.9,
                "rate_limit_delay": (2, 5),  # Random delay between requests
                "max_retries": 3,
                "strategy": "standard"
            },
            "linkedin": {
                "active": True,
                "reliability": 0.7,
                "rate_limit_delay": (3, 7),
                "max_retries": 2,
                "strategy": "careful"  # More careful approach
            },
            "glassdoor": {
                "active": False,  # Currently blocked
                "reliability": 0.3,
                "rate_limit_delay": (5, 10),
                "max_retries": 1,
                "strategy": "experimental"
            },
            "ziprecruiter": {
                "active": True,
                "reliability": 0.8,
                "rate_limit_delay": (2, 4),
                "max_retries": 2,
                "strategy": "standard"
            }
        }
        
        # Enhanced user agent management
        self.user_agents_url = "https://jnrbsn.github.io/user-agents/user-agents.json"
        self.user_agents = []
        self.fallback_user_agents = [
            # Chrome variants
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            # Firefox variants
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
            # Safari
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
            # Edge
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.77"
        ]
        self.last_user_agents_fetch = None
        
        # Session management for persistent cookies
        self.sessions = {}
        
        # Scraping statistics
        self.stats = {
            'total_searches': 0,
            'successful_scrapes': 0,
            'failed_scrapes': 0,
            'jobs_found': 0,
            'jobs_processed': 0,
            'platform_failures': {},
            'last_scrape_time': None
        }
        
        # Initialize user agents
        self._refresh_user_agents()
        
        # Initialize stealth scraper
        self.stealth_scraper = StealthJobScraper()
        
        # Hybrid scraping strategy configuration
        self.use_stealth_fallback = True  # Try stealth if JobSpy fails
    
    def scrape_jobs_enhanced(
        self, 
        search_params: Optional[Dict[str, Any]] = None,
        platforms: Optional[List[str]] = None,
        process_immediately: bool = True
    ) -> Dict[str, Any]:
        """
        Enhanced job scraping with individual job processing and resilience
        
        Args:
            search_params: Override default search parameters
            platforms: Specific platforms to scrape
            process_immediately: Whether to run LLM enhancement immediately
            
        Returns:
            Comprehensive results with statistics
        """
        start_time = datetime.now()
        
        # Use provided params or defaults
        params = {**self.config, **(search_params or {})}
        target_platforms = platforms or [p for p, cfg in self.platforms.items() if cfg['active']]
        
        logger.info(f"Starting enhanced scraping for platforms: {target_platforms}")
        
        results = {
            'total_jobs_found': 0,
            'total_jobs_saved': 0,
            'total_jobs_enhanced': 0,
            'platform_results': {},
            'errors': [],
            'duration_seconds': 0
        }
        
        # Create search variations for better coverage
        search_variations = self._create_search_variations(params)
        
        for platform in target_platforms:
            platform_config = self.platforms[platform]
            platform_results = {
                'searches_attempted': 0,
                'searches_successful': 0,
                'jobs_found': 0,
                'jobs_saved': 0,
                'errors': []
            }
            
            for variation in search_variations:
                try:
                    # Rate limiting
                    self._apply_rate_limit(platform_config['rate_limit_delay'])
                    
                    # Scrape with resilience
                    job_results = self._scrape_platform_resilient(
                        platform=platform,
                        search_params=variation,
                        platform_config=platform_config
                    )
                    
                    # If JobSpy fails and stealth is available, try stealth fallback
                    if (not job_results['success'] and 
                        self.use_stealth_fallback and 
                        self.stealth_scraper.is_available() and
                        platform in ['indeed', 'linkedin']):
                        
                        logger.info(f"Trying stealth fallback for {platform}")
                        stealth_results = self._try_stealth_fallback(platform, variation)
                        if stealth_results['success']:
                            job_results = stealth_results
                    
                    platform_results['searches_attempted'] += 1
                    
                    if job_results['success']:
                        platform_results['searches_successful'] += 1
                        platform_results['jobs_found'] += job_results['jobs_found']
                        platform_results['jobs_saved'] += job_results['jobs_saved']
                        
                        results['total_jobs_found'] += job_results['jobs_found']
                        results['total_jobs_saved'] += job_results['jobs_saved']
                    else:
                        platform_results['errors'].append(job_results['error'])
                        
                except Exception as e:
                    error_msg = f"Platform {platform} search failed: {str(e)}"
                    logger.error(error_msg)
                    platform_results['errors'].append(error_msg)
            
            results['platform_results'][platform] = platform_results
        
        # Process jobs with LLM enhancement if requested
        if process_immediately and results['total_jobs_saved'] > 0:
            logger.info("Starting immediate LLM enhancement of scraped jobs")
            enhancement_result = self.enhanced_processor.process_job_batch(
                limit=results['total_jobs_saved']
            )
            results['total_jobs_enhanced'] = enhancement_result['processed']
        
        # Update statistics
        duration = (datetime.now() - start_time).total_seconds()
        results['duration_seconds'] = duration
        self._update_statistics(results)
        
        logger.info(f"Enhanced scraping complete: {results['total_jobs_found']} found, "
                   f"{results['total_jobs_saved']} saved, {results['total_jobs_enhanced']} enhanced")
        
        return results
    
    def _create_search_variations(self, base_params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Create search parameter variations for better coverage"""
        variations = []
        
        # If we have multiple search terms or locations, create combinations
        search_terms = base_params.get('search_term', self.config['search_terms'])
        if isinstance(search_terms, str):
            search_terms = [search_terms]
        
        locations = base_params.get('location', self.config['locations'])
        if isinstance(locations, str):
            locations = [locations]
        
        # Create reasonable combinations (limit to prevent excessive requests)
        for i, term in enumerate(search_terms[:3]):  # Max 3 search terms
            for j, location in enumerate(locations[:2]):  # Max 2 locations per term
                variation = base_params.copy()
                variation['search_term'] = term
                variation['location'] = location
                variation['results_wanted'] = min(base_params.get('results_wanted', 30), 30)
                variations.append(variation)
        
        return variations
    
    def _scrape_platform_resilient(
        self, 
        platform: str, 
        search_params: Dict[str, Any],
        platform_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Scrape a platform with resilience and individual job processing
        """
        result = {
            'success': False,
            'jobs_found': 0,
            'jobs_saved': 0,
            'error': None
        }
        
        retries = 0
        while retries < platform_config['max_retries']:
            try:
                # Get fresh user agent for each attempt
                user_agent = self._get_random_user_agent()
                
                # Update search params with anti-detection measures
                scrape_params = search_params.copy()
                scrape_params['user_agent'] = user_agent
                
                # Use careful strategy for problematic platforms
                if platform_config['strategy'] == 'careful':
                    scrape_params['results_wanted'] = min(scrape_params.get('results_wanted', 20), 20)
                    logger.info(f"Using careful strategy for {platform}")
                
                logger.info(f"Scraping {platform} with: {scrape_params['search_term']} in {scrape_params['location']}")
                
                # Perform scraping
                df = scrape_jobs(
                    site_name=[platform],
                    search_term=scrape_params['search_term'],
                    location=scrape_params['location'],
                    distance=scrape_params.get('distance', 50),
                    is_remote=scrape_params.get('is_remote', False),
                    results_wanted=scrape_params['results_wanted'],
                    easy_apply=scrape_params.get('easy_apply'),
                    description_format=scrape_params.get('description_format', 'html')
                )
                
                if df is None or df.empty:
                    logger.warning(f"No jobs found on {platform}")
                    result['success'] = True  # Empty result is not an error
                    return result
                
                result['jobs_found'] = len(df)
                
                # Process each job individually to prevent cascade failures
                for _, job_row in df.iterrows():
                    try:
                        # Process and store job
                        job_data = self._process_job_data(job_row, platform)
                        
                        if self._store_job_safe(job_data):
                            result['jobs_saved'] += 1
                            
                    except Exception as e:
                        logger.warning(f"Failed to process individual job from {platform}: {e}")
                        continue  # Don't let one job failure stop the batch
                
                result['success'] = True
                logger.info(f"Successfully scraped {platform}: {result['jobs_found']} found, {result['jobs_saved']} saved")
                return result
                
            except Exception as e:
                retries += 1
                error_msg = f"Attempt {retries} failed for {platform}: {str(e)}"
                logger.warning(error_msg)
                result['error'] = error_msg
                
                if retries < platform_config['max_retries']:
                    # Exponential backoff
                    delay = (2 ** retries) + random.uniform(0, 2)
                    logger.info(f"Retrying {platform} after {delay:.1f} seconds...")
                    time.sleep(delay)
                else:
                    logger.error(f"All retries exhausted for {platform}")
                    
        return result
    
    def _try_stealth_fallback(self, platform: str, search_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Try stealth scraping as fallback when JobSpy fails
        """
        result = {
            'success': False,
            'jobs_found': 0,
            'jobs_saved': 0,
            'error': None,
            'method': 'stealth'
        }
        
        try:
            # Extract parameters
            search_term = search_params.get('search_term', 'software engineer')
            location = search_params.get('location', 'Remote')
            
            # Use stealth scraper
            stealth_jobs = try_stealth_scrape(
                platform=platform,
                search_term=search_term,
                location=location,
                max_pages=1  # Conservative for fallback
            )
            
            if stealth_jobs:
                result['jobs_found'] = len(stealth_jobs)
                
                # Process each stealth job
                for job_data in stealth_jobs:
                    try:
                        # Convert stealth job format to our standard format
                        processed_job = self._process_stealth_job_data(job_data, platform)
                        
                        if processed_job and self._store_job_safe(processed_job):
                            result['jobs_saved'] += 1
                            
                    except Exception as e:
                        logger.warning(f"Failed to process stealth job: {e}")
                        continue
                
                result['success'] = True
                logger.info(f"Stealth fallback successful for {platform}: {result['jobs_saved']} jobs saved")
            
        except Exception as e:
            result['error'] = f"Stealth fallback failed: {str(e)}"
            logger.error(result['error'])
        
        return result
    
    def _process_stealth_job_data(self, stealth_job: Dict[str, Any], platform: str) -> Optional[Dict[str, Any]]:
        """
        Convert stealth job data to standard format
        """
        try:
            # Generate job ID
            job_id_raw = f"{stealth_job.get('title', '')}-{stealth_job.get('company', '')}-{platform}-{stealth_job.get('job_url', '')}"
            job_id = hashlib.md5(job_id_raw.encode()).hexdigest()
            
            # Process location
            location, is_remote = self._process_location(stealth_job.get('location', ''))
            
            # Check for US location
            if not self._is_us_location(location) and not is_remote:
                return None
            
            # Extract basic skills
            skills = self._extract_basic_skills(stealth_job.get('description', ''))
            
            # Determine experience level
            experience_level = self._determine_experience_level(
                stealth_job.get('title', ''), 
                stealth_job.get('description', '')
            )
            
            return {
                "job_id": job_id,
                "title": str(stealth_job.get('title', '')).strip(),
                "company": str(stealth_job.get('company', '')).strip(),
                "location": location,
                "remote": is_remote,
                "job_type": "full-time",  # Default
                "salary_min": None,
                "salary_max": None,
                "salary_currency": "USD",
                "description": self._clean_description(stealth_job.get('description', '')),
                "requirements": "",
                "benefits": "",
                "application_url": stealth_job.get('job_url', ''),
                "company_logo_url": "",
                "platform": platform,
                "date_posted": None,
                "skills": skills,
                "experience_level": experience_level,
                "is_active": True,
                "processing_status": "new",
                "scraped_at": datetime.now()
            }
            
        except Exception as e:
            logger.error(f"Error processing stealth job data: {e}")
            return None
    
    def _process_job_data(self, job_row: pd.Series, platform: str) -> Dict[str, Any]:
        """Process raw job data into standardized format"""
        
        # Generate unique job ID based on title, company, and platform
        job_id_raw = f"{job_row.get('title', '')}-{job_row.get('company', '')}-{platform}-{job_row.get('job_url', '')}"
        job_id = hashlib.md5(job_id_raw.encode()).hexdigest()
        
        # Extract salary information
        salary_min, salary_max = self._extract_salary(job_row)
        
        # Extract skills from description
        skills = self._extract_basic_skills(job_row.get('description', ''))
        
        # Determine experience level
        experience_level = self._determine_experience_level(
            job_row.get('title', ''), 
            job_row.get('description', '')
        )
        
        # Process location and remote status
        location, is_remote = self._process_location(job_row.get('location', ''))
        
        # Check for US location
        if not self._is_us_location(location) and not is_remote:
            logger.debug(f"Skipping non-US job: {location}")
            return None
        
        return {
            "job_id": job_id,
            "title": str(job_row.get('title', '')).strip(),
            "company": str(job_row.get('company', '')).strip(),
            "location": location,
            "remote": is_remote or job_row.get('is_remote', False),
            "job_type": self._standardize_job_type(job_row.get('job_type')),
            "salary_min": salary_min,
            "salary_max": salary_max,
            "salary_currency": "USD",
            "description": self._clean_description(job_row.get('description', '')),
            "requirements": self._extract_requirements(job_row.get('description', '')),
            "benefits": self._extract_benefits(job_row.get('description', '')),
            "application_url": job_row.get('job_url', ''),
            "company_logo_url": job_row.get('company_logo', ''),
            "platform": platform,
            "date_posted": self._parse_date(job_row.get('date_posted')),
            "skills": skills,
            "experience_level": experience_level,
            "is_active": True,
            "processing_status": "new",  # Mark for LLM enhancement
            "scraped_at": datetime.now()
        }
    
    def _store_job_safe(self, job_data: Dict[str, Any]) -> bool:
        """
        Store job with safe error handling
        Returns True if new job was inserted, False if updated or failed
        """
        if not job_data:
            return False
            
        try:
            # Check if job already exists
            existing_job = self.db_manager.execute_query(
                "SELECT id, updated_at FROM jobs WHERE job_id = %s",
                (job_data["job_id"],)
            )
            
            if existing_job:
                # Update existing job if it's older than 24 hours
                last_update = existing_job[0]['updated_at']
                if datetime.now() - last_update > timedelta(hours=24):
                    update_query = """
                    UPDATE jobs SET 
                        description = %s, requirements = %s, benefits = %s,
                        salary_min = %s, salary_max = %s, skills = %s,
                        updated_at = NOW()
                    WHERE job_id = %s
                    """
                    
                    self.db_manager.execute_query(update_query, (
                        job_data["description"], job_data["requirements"], 
                        job_data["benefits"], job_data["salary_min"],
                        job_data["salary_max"], job_data["skills"],
                        job_data["job_id"]
                    ))
                
                return False  # Updated existing
            
            else:
                # Insert new job
                insert_query = """
                INSERT INTO jobs (
                    job_id, title, company, location, remote, job_type,
                    salary_min, salary_max, salary_currency, description,
                    requirements, benefits, application_url, company_logo_url,
                    platform, date_posted, skills, experience_level, is_active,
                    processing_status, scraped_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                self.db_manager.execute_query(insert_query, (
                    job_data["job_id"], job_data["title"], job_data["company"],
                    job_data["location"], job_data["remote"], job_data["job_type"],
                    job_data["salary_min"], job_data["salary_max"], job_data["salary_currency"],
                    job_data["description"], job_data["requirements"], job_data["benefits"],
                    job_data["application_url"], job_data["company_logo_url"],
                    job_data["platform"], job_data["date_posted"], job_data["skills"],
                    job_data["experience_level"], job_data["is_active"],
                    job_data["processing_status"], job_data["scraped_at"]
                ))
                
                return True  # New job inserted
                
        except Exception as e:
            logger.error(f"Error storing job {job_data.get('job_id')}: {e}")
            return False
    
    def _is_us_location(self, location: str) -> bool:
        """Check if location is in the US"""
        if not location:
            return False
            
        us_indicators = [
            'united states', 'usa', 'u.s.', 'us',
            ', al', ', ak', ', az', ', ar', ', ca', ', co', ', ct', ', de', ', fl', ', ga',
            ', hi', ', id', ', il', ', in', ', ia', ', ks', ', ky', ', la', ', me', ', md',
            ', ma', ', mi', ', mn', ', ms', ', mo', ', mt', ', ne', ', nv', ', nh', ', nj',
            ', nm', ', ny', ', nc', ', nd', ', oh', ', ok', ', or', ', pa', ', ri', ', sc',
            ', sd', ', tn', ', tx', ', ut', ', vt', ', va', ', wa', ', wv', ', wi', ', wy',
            'new york', 'san francisco', 'los angeles', 'chicago', 'boston', 'seattle',
            'austin', 'denver', 'atlanta', 'miami', 'dallas', 'houston', 'phoenix'
        ]
        
        location_lower = location.lower()
        return any(indicator in location_lower for indicator in us_indicators)
    
    def _refresh_user_agents(self) -> None:
        """Fetch latest user agents from external source"""
        try:
            current_time = datetime.now()
            if (self.last_user_agents_fetch and 
                (current_time - self.last_user_agents_fetch).total_seconds() < 3600):
                return  # Cache is still valid
            
            response = requests.get(self.user_agents_url, timeout=10)
            response.raise_for_status()
            
            fresh_user_agents = response.json()
            
            if fresh_user_agents and len(fresh_user_agents) > 0:
                # Filter for desktop browsers only
                desktop_agents = [
                    ua for ua in fresh_user_agents 
                    if 'mobile' not in ua.lower() and 'android' not in ua.lower()
                ]
                self.user_agents = desktop_agents[:50]  # Keep top 50
                self.last_user_agents_fetch = current_time
                logger.info(f"Refreshed {len(self.user_agents)} user agents")
                
        except Exception as e:
            logger.warning(f"Failed to refresh user agents: {e}")
            if not self.user_agents:
                self.user_agents = self.fallback_user_agents
    
    def _get_random_user_agent(self) -> str:
        """Get a random user agent"""
        self._refresh_user_agents()
        return random.choice(self.user_agents)
    
    def _apply_rate_limit(self, delay_range: Tuple[int, int]):
        """Apply random delay to avoid rate limiting"""
        delay = random.uniform(delay_range[0], delay_range[1])
        time.sleep(delay)
    
    def _extract_salary(self, job_row: pd.Series) -> Tuple[Optional[int], Optional[int]]:
        """Extract salary range from job data"""
        import re
        
        salary_text = ""
        for field in ['salary', 'compensation', 'min_amount', 'max_amount']:
            if pd.notna(job_row.get(field)):
                salary_text += str(job_row[field]) + " "
        
        if not salary_text.strip():
            return None, None
        
        # Extract salary numbers
        salary_numbers = re.findall(r'\$?([\d,]+)k?', salary_text.replace(',', ''))
        
        if len(salary_numbers) >= 2:
            try:
                min_sal = int(salary_numbers[0].replace(',', ''))
                max_sal = int(salary_numbers[1].replace(',', ''))
                
                if 'k' in salary_text.lower():
                    min_sal *= 1000
                    max_sal *= 1000
                
                return min_sal, max_sal
            except ValueError:
                pass
        
        return None, None
    
    def _extract_basic_skills(self, description: str) -> List[str]:
        """Extract basic skills (enhanced extraction done later by LLM)"""
        import re
        
        if not description:
            return []
        
        # Basic skill patterns
        skill_patterns = [
            r'\b(?:JavaScript|TypeScript|Python|Java|C\+\+|C#|Go|Rust|Swift|Kotlin|Ruby|PHP|Scala)\b',
            r'\b(?:React|Angular|Vue|Node\.js|Express|Django|Flask|Spring|Laravel|Rails)\b',
            r'\b(?:AWS|Azure|GCP|Docker|Kubernetes|Jenkins|Git|GraphQL|REST|Redis)\b',
            r'\b(?:PostgreSQL|MySQL|MongoDB|Elasticsearch|Cassandra|DynamoDB)\b'
        ]
        
        skills = set()
        for pattern in skill_patterns:
            matches = re.findall(pattern, description, re.IGNORECASE)
            skills.update(matches)
        
        return list(skills)[:20]
    
    def _determine_experience_level(self, title: str, description: str) -> str:
        """Basic experience level detection"""
        text = f"{title} {description}".lower()
        
        if any(term in text for term in ['senior', 'sr.', 'lead', 'principal', 'staff', 'architect']):
            return 'senior'
        elif any(term in text for term in ['junior', 'jr.', 'entry', 'graduate', 'intern']):
            return 'entry'
        else:
            return 'mid'
    
    def _process_location(self, location: Any) -> Tuple[str, bool]:
        """Process location and determine remote status"""
        import re
        
        if not location:
            return "", False
        
        location = str(location).strip()
        is_remote = any(term in location.lower() for term in ['remote', 'work from home', 'wfh', 'anywhere'])
        
        # Clean up location string
        location = re.sub(r'\b(remote|work from home|wfh)\b', '', location, flags=re.IGNORECASE).strip()
        location = re.sub(r'\s+', ' ', location)
        
        return location, is_remote
    
    def _standardize_job_type(self, job_type: Any) -> str:
        """Standardize job type"""
        if not job_type:
            return "full-time"
        
        job_type_str = str(job_type).lower().strip()
        
        if 'full' in job_type_str:
            return "full-time"
        elif 'part' in job_type_str:
            return "part-time"
        elif 'contract' in job_type_str:
            return "contract"
        elif 'intern' in job_type_str:
            return "internship"
        else:
            return "full-time"
    
    def _clean_description(self, description: str) -> str:
        """Clean job description"""
        import re
        
        if not description:
            return ""
        
        # Remove excessive whitespace
        description = re.sub(r'\s+', ' ', description)
        
        # Remove HTML tags
        description = re.sub(r'<[^>]+>', '', description)
        
        return description[:5000].strip()
    
    def _extract_requirements(self, description: str) -> str:
        """Extract requirements section"""
        import re
        
        if not description:
            return ""
        
        requirements_match = re.search(
            r'(?:requirements?|qualifications?|must have|needed):(.+?)(?:responsibilities?|benefits?|about|$)',
            description,
            re.IGNORECASE | re.DOTALL
        )
        
        if requirements_match:
            return requirements_match.group(1).strip()[:2000]
        
        return ""
    
    def _extract_benefits(self, description: str) -> str:
        """Extract benefits section"""
        import re
        
        if not description:
            return ""
        
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
        from dateutil import parser
        
        if pd.isna(date_value):
            return None
        
        if isinstance(date_value, datetime):
            return date_value
        
        if isinstance(date_value, str):
            try:
                return parser.parse(date_value)
            except:
                pass
        
        return None
    
    def _update_statistics(self, results: Dict[str, Any]):
        """Update scraping statistics"""
        self.stats['total_searches'] += sum(
            r['searches_attempted'] for r in results['platform_results'].values()
        )
        self.stats['successful_scrapes'] += sum(
            r['searches_successful'] for r in results['platform_results'].values()
        )
        self.stats['jobs_found'] += results['total_jobs_found']
        self.stats['jobs_processed'] += results['total_jobs_saved']
        self.stats['last_scrape_time'] = datetime.now()
        
        # Update platform failure tracking
        for platform, result in results['platform_results'].items():
            if result['errors']:
                self.stats['platform_failures'][platform] = self.stats['platform_failures'].get(platform, 0) + 1
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get scraping statistics"""
        return {
            **self.stats,
            'success_rate': (
                self.stats['successful_scrapes'] / max(1, self.stats['total_searches'])
            ) * 100,
            'active_platforms': [p for p, cfg in self.platforms.items() if cfg['active']],
            'platform_reliability': {
                p: cfg['reliability'] for p, cfg in self.platforms.items()
            }
        }


class BackgroundJobScraper:
    """
    Background job scraper with async processing
    Implements the "In-Process Background Task" pattern discussed
    """
    
    def __init__(self, scraper: EnhancedJobScrapingService):
        self.scraper = scraper
        self.is_running = False
        self.thread = None
        self.tasks = {}  # Task ID -> Task Status
        
    def start_scraping_task(self, search_params: Optional[Dict] = None) -> str:
        """Start a background scraping task and return task ID"""
        import uuid
        
        task_id = str(uuid.uuid4())
        self.tasks[task_id] = {
            "status": "pending",
            "started_at": datetime.now(),
            "progress": 0,
            "total": 0,
            "results": None,
            "error": None
        }
        
        # Start scraping in background thread
        thread = threading.Thread(
            target=self._run_scraping_task,
            args=(task_id, search_params),
            daemon=True
        )
        thread.start()
        
        logger.info(f"Started background scraping task: {task_id}")
        return task_id
    
    def _run_scraping_task(self, task_id: str, search_params: Optional[Dict]):
        """Run the scraping task in background"""
        try:
            self.tasks[task_id]["status"] = "running"
            
            # Perform enhanced scraping
            results = self.scraper.scrape_jobs_enhanced(
                search_params=search_params,
                process_immediately=True  # Also run LLM enhancement
            )
            
            self.tasks[task_id]["status"] = "completed"
            self.tasks[task_id]["results"] = results
            self.tasks[task_id]["completed_at"] = datetime.now()
            
        except Exception as e:
            logger.error(f"Background scraping task {task_id} failed: {e}")
            self.tasks[task_id]["status"] = "failed"
            self.tasks[task_id]["error"] = str(e)
    
    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Get status of a background task"""
        return self.tasks.get(task_id, {"status": "not_found"})
    
    def cleanup_old_tasks(self, hours: int = 24):
        """Clean up tasks older than specified hours"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        old_tasks = [
            task_id for task_id, task in self.tasks.items()
            if task.get("started_at", datetime.now()) < cutoff_time
        ]
        
        for task_id in old_tasks:
            del self.tasks[task_id]
        
        logger.info(f"Cleaned up {len(old_tasks)} old tasks")


if __name__ == "__main__":
    # Test the enhanced scraper
    logging.basicConfig(level=logging.INFO)
    
    scraper = EnhancedJobScrapingService()
    
    # Test scraping with custom parameters
    results = scraper.scrape_jobs_enhanced(
        search_params={
            "search_term": "python developer",
            "location": "Remote USA",
            "results_wanted": 10
        },
        platforms=["indeed"],
        process_immediately=False
    )
    
    print(f"Scraping results: {json.dumps(results, indent=2)}")
    print(f"Statistics: {json.dumps(scraper.get_statistics(), indent=2)}")