"""
LinkedIn Job URL Parser Service
Handles parsing job posting URLs to extract company, role, and job description
"""

import re
import logging
import requests
from typing import Dict, Optional, Tuple
from urllib.parse import urlparse, parse_qs
from bs4 import BeautifulSoup
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class JobData:
    company: str
    role: str
    description: str
    success: bool = True
    error: Optional[str] = None

class LinkedInParser:
    """LinkedIn job URL parser service"""
    
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        self.timeout = 10
        
    def validate_linkedin_url(self, url: str) -> bool:
        """Validate if URL is a LinkedIn job posting"""
        try:
            parsed = urlparse(url)
            return (
                parsed.netloc.endswith('linkedin.com') and
                '/jobs/view/' in parsed.path
            )
        except Exception:
            return False
    
    def extract_job_id(self, url: str) -> Optional[str]:
        """Extract job ID from LinkedIn URL"""
        try:
            # Pattern for job ID in path: /jobs/view/1234567890/
            path_match = re.search(r'/jobs/view/(\d+)', url)
            if path_match:
                return path_match.group(1)
            
            # Pattern for job ID in query params
            parsed = urlparse(url)
            query_params = parse_qs(parsed.query)
            
            # Check various parameter names
            for param in ['currentJobId', 'jobId', 'id']:
                if param in query_params:
                    return query_params[param][0]
                    
            return None
        except Exception as e:
            logger.error(f"Error extracting job ID: {e}")
            return None
    
    def parse_job_url(self, url: str) -> JobData:
        """
        Parse LinkedIn job URL and extract job information
        
        Args:
            url: LinkedIn job posting URL
            
        Returns:
            JobData object with extracted information
        """
        if not self.validate_linkedin_url(url):
            return JobData(
                company="", 
                role="", 
                description="",
                success=False,
                error="Invalid LinkedIn job URL. Please provide a valid LinkedIn job posting URL."
            )
        
        job_id = self.extract_job_id(url)
        if not job_id:
            return JobData(
                company="", 
                role="", 
                description="",
                success=False,
                error="Could not extract job ID from URL. Please check the URL format."
            )
        
        try:
            # Make request to LinkedIn
            response = requests.get(url, headers=self.headers, timeout=self.timeout)
            response.raise_for_status()
            
            # Parse HTML content
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract job information
            company = self._extract_company(soup)
            role = self._extract_role(soup)
            description = self._extract_description(soup)
            
            if not company or not role:
                return JobData(
                    company="", 
                    role="", 
                    description="",
                    success=False,
                    error="Could not extract job information. The page might be private or have restricted access."
                )
            
            return JobData(
                company=company,
                role=role,
                description=description or "Job description not available",
                success=True
            )
            
        except requests.RequestException as e:
            logger.error(f"Network error parsing LinkedIn URL: {e}")
            return JobData(
                company="", 
                role="", 
                description="",
                success=False,
                error="Network error: Unable to fetch job posting. Please check your internet connection."
            )
        except Exception as e:
            logger.error(f"Error parsing LinkedIn job: {e}")
            return JobData(
                company="", 
                role="", 
                description="",
                success=False,
                error="Error parsing job posting. The page structure might have changed."
            )
    
    def _extract_company(self, soup: BeautifulSoup) -> str:
        """Extract company name from LinkedIn job page"""
        # Try multiple selectors for company name
        selectors = [
            'a[data-tracking-control-name="public_jobs_topcard-org-name"] .topcard__org-name-link',
            '.topcard__org-name-link',
            '.topcard__flavor--company-name',
            '.jobs-unified-top-card__company-name',
            '[data-test-id="job-details-company-name"]',
            '.job-details-company-name',
            'h4.topcard__org-name-link',
            '.topcard__org-name'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                company = element.get_text(strip=True)
                if company:
                    return company
        
        return ""
    
    def _extract_role(self, soup: BeautifulSoup) -> str:
        """Extract job role/title from LinkedIn job page"""
        # Try multiple selectors for job title
        selectors = [
            'h1.topcard__title',
            '.topcard__title',
            '.jobs-unified-top-card__job-title',
            '[data-test-id="job-details-job-title"]',
            '.job-details-job-title h1',
            '.t-24.t-bold'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                role = element.get_text(strip=True)
                if role:
                    return role
        
        return ""
    
    def _extract_description(self, soup: BeautifulSoup) -> str:
        """Extract job description from LinkedIn job page"""
        # Try multiple selectors for job description
        selectors = [
            '.jobs-description-content__text',
            '.jobs-description__content',
            '.jobs-box__html-content',
            '.description__text',
            '#job-details',
            '.jobs-description-content',
            '[data-test-id="job-details-description"]'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                # Get text and clean it up
                description = element.get_text(separator='\n', strip=True)
                if description and len(description.strip()) > 50:  # Basic validation
                    return self._clean_description(description)
        
        return ""
    
    def _clean_description(self, description: str) -> str:
        """Clean and format job description text"""
        # Remove extra whitespace and normalize line breaks
        description = re.sub(r'\n\s*\n', '\n\n', description)
        description = re.sub(r' +', ' ', description)
        
        # Remove common LinkedIn-specific text
        patterns_to_remove = [
            r'Show more\n',
            r'Show less\n',
            r'Apply on company website\n',
            r'Report this job\n',
            r'LinkedIn members get \$10 off LinkedIn Learning.*',
            r'Promote your profile\n'
        ]
        
        for pattern in patterns_to_remove:
            description = re.sub(pattern, '', description, flags=re.IGNORECASE)
        
        return description.strip()