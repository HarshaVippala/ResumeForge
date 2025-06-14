#!/usr/bin/env python3
"""
Advanced Stealth Scraper
Optional enhanced scraper using Playwright with stealth capabilities
"""

import os
import json
import logging
import random
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime

try:
    from playwright.async_api import async_playwright
    from playwright_stealth import stealth_async
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    async_playwright = None
    stealth_async = None

logger = logging.getLogger(__name__)

class StealthJobScraper:
    """
    Advanced stealth job scraper using Playwright
    Fallback available if Playwright is not installed
    """
    
    def __init__(self):
        self.available = PLAYWRIGHT_AVAILABLE
        
        if not self.available:
            logger.warning("Playwright not available. Stealth scraping disabled.")
            return
            
        # Browser configuration
        self.browser_config = {
            'headless': True,
            'viewport': {'width': 1920, 'height': 1080},
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'locale': 'en-US',
            'timezone_id': 'America/New_York'
        }
        
        # Site-specific selectors
        self.selectors = {
            'indeed': {
                'job_cards': '[data-testid="job-card"]',
                'job_title': '[data-testid="job-title"] a',
                'company': '[data-testid="company-name"]',
                'location': '[data-testid="job-location"]',
                'description': '[data-testid="job-description"]',
                'next_page': 'a[aria-label="Next Page"]'
            },
            'linkedin': {
                'job_cards': '.job-search-card',
                'job_title': '.job-search-card__title a',
                'company': '.job-search-card__subtitle-primary',
                'location': '.job-search-card__subtitle-secondary',
                'description': '.job-details__description',
                'next_page': '.artdeco-pagination__button--next'
            }
        }
        
        # Rate limiting
        self.delays = {
            'page_load': (2, 4),
            'between_jobs': (0.5, 1.5),
            'between_pages': (3, 6)
        }
    
    async def scrape_indeed_stealth(
        self, 
        search_term: str, 
        location: str = "Remote", 
        max_pages: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Scrape Indeed using stealth Playwright
        """
        if not self.available:
            logger.error("Stealth scraping not available - Playwright not installed")
            return []
        
        jobs = []
        
        try:
            async with async_playwright() as p:
                # Launch browser with stealth configuration
                browser = await p.chromium.launch(**self.browser_config)
                context = await browser.new_context(
                    viewport=self.browser_config['viewport'],
                    user_agent=self.browser_config['user_agent'],
                    locale=self.browser_config['locale'],
                    timezone_id=self.browser_config['timezone_id']
                )
                
                page = await context.new_page()
                
                # Apply stealth modifications
                await stealth_async(page)
                
                # Navigate to Indeed search
                search_url = f"https://www.indeed.com/jobs?q={search_term}&l={location}&sort=date"
                await page.goto(search_url, wait_until='networkidle')
                
                # Random delay after page load
                await self._random_delay(self.delays['page_load'])
                
                for page_num in range(max_pages):
                    logger.info(f"Scraping Indeed page {page_num + 1}")
                    
                    # Extract jobs from current page
                    page_jobs = await self._extract_indeed_jobs(page)
                    jobs.extend(page_jobs)
                    
                    logger.info(f"Found {len(page_jobs)} jobs on page {page_num + 1}")
                    
                    # Try to navigate to next page
                    if page_num < max_pages - 1:
                        try:
                            next_button = await page.wait_for_selector(
                                self.selectors['indeed']['next_page'], 
                                timeout=5000
                            )
                            
                            if next_button:
                                await next_button.click()
                                await page.wait_for_load_state('networkidle')
                                await self._random_delay(self.delays['between_pages'])
                            else:
                                logger.info("No more pages available")
                                break
                                
                        except Exception as e:
                            logger.warning(f"Could not navigate to next page: {e}")
                            break
                
                await browser.close()
                
        except Exception as e:
            logger.error(f"Stealth scraping failed: {e}")
            return []
        
        logger.info(f"Stealth scraping complete: {len(jobs)} jobs found")
        return jobs
    
    async def _extract_indeed_jobs(self, page) -> List[Dict[str, Any]]:
        """Extract job data from Indeed page"""
        jobs = []
        
        try:
            # Wait for job cards to load
            await page.wait_for_selector(self.selectors['indeed']['job_cards'], timeout=10000)
            
            # Get all job cards
            job_cards = await page.query_selector_all(self.selectors['indeed']['job_cards'])
            
            for i, card in enumerate(job_cards):
                try:
                    # Extract basic information
                    title_element = await card.query_selector(self.selectors['indeed']['job_title'])
                    company_element = await card.query_selector(self.selectors['indeed']['company'])
                    location_element = await card.query_selector(self.selectors['indeed']['location'])
                    
                    if not title_element:
                        continue
                    
                    title = await title_element.inner_text()
                    company = await company_element.inner_text() if company_element else ""
                    location = await location_element.inner_text() if location_element else ""
                    
                    # Get job URL
                    job_url = await title_element.get_attribute('href')
                    if job_url and not job_url.startswith('http'):
                        job_url = f"https://www.indeed.com{job_url}"
                    
                    # Click to get description (with caution)
                    description = ""
                    try:
                        await title_element.click()
                        await page.wait_for_timeout(random.randint(1000, 2000))
                        
                        desc_element = await page.query_selector(self.selectors['indeed']['description'])
                        if desc_element:
                            description = await desc_element.inner_text()
                            
                    except Exception as desc_error:
                        logger.debug(f"Could not get description for job {i}: {desc_error}")
                    
                    job_data = {
                        'title': title.strip(),
                        'company': company.strip(),
                        'location': location.strip(),
                        'description': description.strip(),
                        'job_url': job_url,
                        'platform': 'indeed',
                        'scraped_at': datetime.now().isoformat(),
                        'scraping_method': 'stealth'
                    }
                    
                    jobs.append(job_data)
                    
                    # Small delay between job extractions
                    await self._random_delay(self.delays['between_jobs'])
                    
                except Exception as job_error:
                    logger.debug(f"Error extracting job {i}: {job_error}")
                    continue
            
        except Exception as e:
            logger.error(f"Error extracting jobs from page: {e}")
        
        return jobs
    
    async def scrape_linkedin_stealth(
        self, 
        search_term: str, 
        location: str = "United States", 
        max_pages: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Scrape LinkedIn using stealth Playwright (more careful approach)
        """
        if not self.available:
            logger.error("Stealth scraping not available - Playwright not installed")
            return []
        
        jobs = []
        
        try:
            async with async_playwright() as p:
                # More careful configuration for LinkedIn
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                )
                
                context = await browser.new_context(
                    viewport={'width': 1366, 'height': 768},
                    user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    locale='en-US'
                )
                
                page = await context.new_page()
                await stealth_async(page)
                
                # Navigate to LinkedIn jobs
                search_url = f"https://www.linkedin.com/jobs/search/?keywords={search_term}&location={location}&sortBy=DD"
                await page.goto(search_url, wait_until='networkidle')
                
                # Longer delay for LinkedIn
                await self._random_delay((5, 8))
                
                for page_num in range(max_pages):
                    logger.info(f"Scraping LinkedIn page {page_num + 1}")
                    
                    # Extract jobs from current page
                    page_jobs = await self._extract_linkedin_jobs(page)
                    jobs.extend(page_jobs)
                    
                    logger.info(f"Found {len(page_jobs)} jobs on page {page_num + 1}")
                    
                    # Very careful pagination for LinkedIn
                    if page_num < max_pages - 1:
                        try:
                            await page.scroll_to_bottom()
                            await self._random_delay((3, 5))
                            
                            next_button = await page.query_selector(self.selectors['linkedin']['next_page'])
                            if next_button:
                                await next_button.click()
                                await page.wait_for_load_state('networkidle')
                                await self._random_delay((5, 8))
                            else:
                                break
                                
                        except Exception as e:
                            logger.warning(f"LinkedIn pagination failed: {e}")
                            break
                
                await browser.close()
                
        except Exception as e:
            logger.error(f"LinkedIn stealth scraping failed: {e}")
            return []
        
        logger.info(f"LinkedIn stealth scraping complete: {len(jobs)} jobs found")
        return jobs
    
    async def _extract_linkedin_jobs(self, page) -> List[Dict[str, Any]]:
        """Extract job data from LinkedIn page"""
        jobs = []
        
        try:
            # Wait for job cards
            await page.wait_for_selector(self.selectors['linkedin']['job_cards'], timeout=15000)
            
            job_cards = await page.query_selector_all(self.selectors['linkedin']['job_cards'])
            
            for i, card in enumerate(job_cards):
                try:
                    title_element = await card.query_selector(self.selectors['linkedin']['job_title'])
                    company_element = await card.query_selector(self.selectors['linkedin']['company'])
                    location_element = await card.query_selector(self.selectors['linkedin']['location'])
                    
                    if not title_element:
                        continue
                    
                    title = await title_element.inner_text()
                    company = await company_element.inner_text() if company_element else ""
                    location = await location_element.inner_text() if location_element else ""
                    
                    job_url = await title_element.get_attribute('href')
                    
                    job_data = {
                        'title': title.strip(),
                        'company': company.strip(),
                        'location': location.strip(),
                        'description': "",  # LinkedIn descriptions require additional clicks
                        'job_url': job_url,
                        'platform': 'linkedin',
                        'scraped_at': datetime.now().isoformat(),
                        'scraping_method': 'stealth'
                    }
                    
                    jobs.append(job_data)
                    
                    # Careful delays for LinkedIn
                    await self._random_delay((1, 2))
                    
                except Exception as job_error:
                    logger.debug(f"Error extracting LinkedIn job {i}: {job_error}")
                    continue
            
        except Exception as e:
            logger.error(f"Error extracting LinkedIn jobs: {e}")
        
        return jobs
    
    async def _random_delay(self, delay_range: tuple):
        """Apply random delay"""
        delay = random.uniform(delay_range[0], delay_range[1])
        await asyncio.sleep(delay)
    
    def scrape_sync(
        self, 
        platform: str, 
        search_term: str, 
        location: str = "Remote", 
        max_pages: int = 2
    ) -> List[Dict[str, Any]]:
        """
        Synchronous wrapper for stealth scraping
        """
        if not self.available:
            return []
        
        if platform == 'indeed':
            return asyncio.run(self.scrape_indeed_stealth(search_term, location, max_pages))
        elif platform == 'linkedin':
            return asyncio.run(self.scrape_linkedin_stealth(search_term, location, max_pages))
        else:
            logger.error(f"Stealth scraping not implemented for platform: {platform}")
            return []
    
    def is_available(self) -> bool:
        """Check if stealth scraping is available"""
        return self.available


# Utility function for optional stealth scraping
def try_stealth_scrape(
    platform: str, 
    search_term: str, 
    location: str = "Remote", 
    max_pages: int = 2
) -> List[Dict[str, Any]]:
    """
    Try stealth scraping, fallback gracefully if not available
    """
    try:
        scraper = StealthJobScraper()
        if scraper.is_available():
            return scraper.scrape_sync(platform, search_term, location, max_pages)
        else:
            logger.info("Stealth scraping not available, use regular JobSpy")
            return []
    except Exception as e:
        logger.error(f"Stealth scraping failed: {e}")
        return []


if __name__ == "__main__":
    # Test stealth scraping
    logging.basicConfig(level=logging.INFO)
    
    scraper = StealthJobScraper()
    
    if scraper.is_available():
        print("Testing stealth scraping...")
        jobs = scraper.scrape_sync("indeed", "python developer", "Remote", 1)
        print(f"Found {len(jobs)} jobs")
        
        if jobs:
            print(f"Sample job: {json.dumps(jobs[0], indent=2)}")
    else:
        print("Stealth scraping not available - install playwright and playwright-stealth")