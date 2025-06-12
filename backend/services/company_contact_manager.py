#!/usr/bin/env python3
"""
Company and Contact Auto-Creation Service
Handles intelligent company/contact creation and deduplication
"""

import logging
import re
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class CompanyMatch:
    """Company matching result"""
    company_id: Optional[int] = None
    is_new: bool = False
    confidence: float = 0.0
    match_method: str = ""

@dataclass
class ContactMatch:
    """Contact matching result"""
    contact_id: Optional[int] = None
    is_new: bool = False
    confidence: float = 0.0
    match_method: str = ""

class CompanyContactManager:
    """
    Manages automatic company and contact creation/matching
    """
    
    def __init__(self, database_manager):
        self.db_manager = database_manager
        
    def find_or_create_company(self, enhanced_data) -> CompanyMatch:
        """
        Find existing company or create new one
        """
        try:
            company_name = enhanced_data.company_name.strip()
            company_domain = enhanced_data.company_domain.strip()
            
            if not company_name and not company_domain:
                return CompanyMatch()
            
            # Try to find existing company
            existing_company = self._find_existing_company(company_name, company_domain)
            
            if existing_company:
                return CompanyMatch(
                    company_id=existing_company['id'],
                    is_new=False,
                    confidence=existing_company['confidence'],
                    match_method=existing_company['method']
                )
            
            # Create new company
            new_company_id = self._create_new_company(enhanced_data)
            
            if new_company_id:
                return CompanyMatch(
                    company_id=new_company_id,
                    is_new=True,
                    confidence=0.8,
                    match_method="created"
                )
            
        except Exception as e:
            logger.error(f"Company find/create error: {e}")
        
        return CompanyMatch()
    
    def find_or_create_contact(self, enhanced_data, company_id: Optional[int]) -> ContactMatch:
        """
        Find existing contact or create new one
        """
        try:
            recruiter_email = enhanced_data.recruiter_email.strip()
            recruiter_name = enhanced_data.recruiter_name.strip()
            
            if not recruiter_email and not recruiter_name:
                return ContactMatch()
            
            # Try to find existing contact
            existing_contact = self._find_existing_contact(recruiter_email, recruiter_name, company_id)
            
            if existing_contact:
                return ContactMatch(
                    contact_id=existing_contact['id'],
                    is_new=False,
                    confidence=existing_contact['confidence'],
                    match_method=existing_contact['method']
                )
            
            # Create new contact
            new_contact_id = self._create_new_contact(enhanced_data, company_id)
            
            if new_contact_id:
                return ContactMatch(
                    contact_id=new_contact_id,
                    is_new=True,
                    confidence=0.8,
                    match_method="created"
                )
            
        except Exception as e:
            logger.error(f"Contact find/create error: {e}")
        
        return ContactMatch()
    
    def _find_existing_company(self, company_name: str, company_domain: str) -> Optional[Dict]:
        """Find existing company using various matching strategies"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Strategy 1: Exact domain match (highest confidence)
                if company_domain:
                    cursor.execute(
                        "SELECT id, name, domain FROM companies WHERE domain = %s",
                        (company_domain,)
                    )
                    result = cursor.fetchone()
                    if result:
                        return {
                            'id': result[0],
                            'confidence': 1.0,
                            'method': 'exact_domain'
                        }
                
                # Strategy 2: Exact name match (high confidence)
                if company_name:
                    cursor.execute(
                        "SELECT id, name, domain FROM companies WHERE LOWER(name) = LOWER(%s)",
                        (company_name,)
                    )
                    result = cursor.fetchone()
                    if result:
                        return {
                            'id': result[0],
                            'confidence': 0.9,
                            'method': 'exact_name'
                        }
                
                # Strategy 3: Fuzzy name match (medium confidence)
                if company_name:
                    # Remove common suffixes for better matching
                    clean_name = self._clean_company_name(company_name)
                    
                    cursor.execute(
                        "SELECT id, name, domain FROM companies WHERE LOWER(name) LIKE %s",
                        (f"%{clean_name.lower()}%",)
                    )
                    results = cursor.fetchall()
                    
                    for result in results:
                        # Check similarity
                        similarity = self._calculate_name_similarity(clean_name, result[1])
                        if similarity > 0.8:
                            return {
                                'id': result[0],
                                'confidence': similarity,
                                'method': 'fuzzy_name'
                            }
                
                # Strategy 4: Domain similarity (lower confidence)
                if company_domain:
                    domain_root = company_domain.split('.')[0]
                    cursor.execute(
                        "SELECT id, name, domain FROM companies WHERE domain LIKE %s",
                        (f"%{domain_root}%",)
                    )
                    results = cursor.fetchall()
                    
                    for result in results:
                        if result[2]:  # Has domain
                            similarity = self._calculate_domain_similarity(company_domain, result[2])
                            if similarity > 0.7:
                                return {
                                    'id': result[0],
                                    'confidence': similarity,
                                    'method': 'similar_domain'
                                }
                
        except Exception as e:
            logger.error(f"Error finding existing company: {e}")
        
        return None
    
    def _find_existing_contact(self, email: str, name: str, company_id: Optional[int]) -> Optional[Dict]:
        """Find existing contact using various matching strategies"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Strategy 1: Exact email match (highest confidence)
                if email:
                    cursor.execute(
                        "SELECT id, name, email, company_id FROM contacts WHERE LOWER(email) = LOWER(%s)",
                        (email,)
                    )
                    result = cursor.fetchone()
                    if result:
                        return {
                            'id': result[0],
                            'confidence': 1.0,
                            'method': 'exact_email'
                        }
                
                # Strategy 2: Name match within same company (high confidence)
                if name and company_id:
                    cursor.execute(
                        "SELECT id, name, email, company_id FROM contacts WHERE LOWER(name) = LOWER(%s) AND company_id = %s",
                        (name, company_id)
                    )
                    result = cursor.fetchone()
                    if result:
                        return {
                            'id': result[0],
                            'confidence': 0.9,
                            'method': 'name_company_match'
                        }
                
                # Strategy 3: Fuzzy name match (medium confidence)
                if name:
                    clean_name = self._clean_contact_name(name)
                    cursor.execute(
                        "SELECT id, name, email, company_id FROM contacts WHERE LOWER(name) LIKE %s",
                        (f"%{clean_name.lower()}%",)
                    )
                    results = cursor.fetchall()
                    
                    for result in results:
                        similarity = self._calculate_name_similarity(clean_name, result[1])
                        if similarity > 0.8:
                            return {
                                'id': result[0],
                                'confidence': similarity,
                                'method': 'fuzzy_name'
                            }
                
        except Exception as e:
            logger.error(f"Error finding existing contact: {e}")
        
        return None
    
    def _create_new_company(self, enhanced_data) -> Optional[int]:
        """Create new company record"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Prepare company data
                company_data = {
                    'name': enhanced_data.company_name or self._extract_name_from_domain(enhanced_data.company_domain),
                    'domain': enhanced_data.company_domain,
                    'industry': enhanced_data.industry or self._infer_industry(enhanced_data.company_domain),
                    'size': enhanced_data.company_size,
                    'location': enhanced_data.location,
                    'website': f"https://{enhanced_data.company_domain}" if enhanced_data.company_domain else None
                }
                
                # Insert company
                cursor.execute("""
                    INSERT INTO companies (name, domain, industry, size, location, website)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    company_data['name'],
                    company_data['domain'],
                    company_data['industry'],
                    company_data['size'],
                    company_data['location'],
                    company_data['website']
                ))
                
                result = cursor.fetchone()
                company_id = result[0] if result else None
                conn.commit()
                
                logger.info(f"Created new company: {company_data['name']} (ID: {company_id})")
                return company_id
                
        except Exception as e:
            logger.error(f"Error creating new company: {e}")
        
        return None
    
    def _create_new_contact(self, enhanced_data, company_id: Optional[int]) -> Optional[int]:
        """Create new contact record"""
        try:
            with self.db_manager.get_connection() as conn:
                cursor = conn.cursor()
                
                # Prepare contact data
                contact_data = {
                    'company_id': company_id,
                    'name': enhanced_data.recruiter_name,
                    'email': enhanced_data.recruiter_email,
                    'phone': enhanced_data.recruiter_phone,
                    'title': enhanced_data.recruiter_title,
                    'role_type': enhanced_data.contact_type or self._infer_contact_type(enhanced_data.recruiter_title),
                    'linkedin_url': enhanced_data.recruiter_linkedin
                }
                
                # Insert contact
                cursor.execute("""
                    INSERT INTO contacts (company_id, name, email, phone, title, role_type, linkedin_url)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    contact_data['company_id'],
                    contact_data['name'],
                    contact_data['email'],
                    contact_data['phone'],
                    contact_data['title'],
                    contact_data['role_type'],
                    contact_data['linkedin_url']
                ))
                
                result = cursor.fetchone()
                contact_id = result[0] if result else None
                conn.commit()
                
                logger.info(f"Created new contact: {contact_data['name']} (ID: {contact_id})")
                return contact_id
                
        except Exception as e:
            logger.error(f"Error creating new contact: {e}")
        
        return None
    
    def _clean_company_name(self, name: str) -> str:
        """Clean company name for better matching"""
        # Remove common suffixes
        suffixes = ['Inc', 'LLC', 'Corp', 'Corporation', 'Ltd', 'Limited', 'Co', 'Company']
        clean_name = name
        
        for suffix in suffixes:
            clean_name = re.sub(rf'\b{suffix}\.?\b', '', clean_name, flags=re.IGNORECASE)
        
        return clean_name.strip()
    
    def _clean_contact_name(self, name: str) -> str:
        """Clean contact name for better matching"""
        # Remove titles and clean up
        titles = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof']
        clean_name = name
        
        for title in titles:
            clean_name = re.sub(rf'\b{title}\.?\b', '', clean_name, flags=re.IGNORECASE)
        
        return clean_name.strip()
    
    def _calculate_name_similarity(self, name1: str, name2: str) -> float:
        """Calculate similarity between two names"""
        # Simple similarity calculation
        name1_words = set(name1.lower().split())
        name2_words = set(name2.lower().split())
        
        if not name1_words or not name2_words:
            return 0.0
        
        intersection = name1_words.intersection(name2_words)
        union = name1_words.union(name2_words)
        
        return len(intersection) / len(union) if union else 0.0
    
    def _calculate_domain_similarity(self, domain1: str, domain2: str) -> float:
        """Calculate similarity between two domains"""
        if domain1 == domain2:
            return 1.0
        
        # Extract root domains
        root1 = domain1.split('.')[0].lower()
        root2 = domain2.split('.')[0].lower()
        
        if root1 == root2:
            return 0.9
        
        # Check if one contains the other
        if root1 in root2 or root2 in root1:
            return 0.8
        
        return 0.0
    
    def _extract_name_from_domain(self, domain: str) -> str:
        """Extract company name from domain"""
        if not domain:
            return "Unknown Company"
        
        # Extract root domain and clean it up
        root = domain.split('.')[0]
        # Convert to title case and handle common patterns
        name = root.replace('-', ' ').replace('_', ' ').title()
        
        return name
    
    def _infer_industry(self, domain: str) -> str:
        """Infer industry from domain"""
        if not domain:
            return ""
        
        domain_lower = domain.lower()
        
        industry_keywords = {
            'tech': ['tech', 'software', 'data', 'ai', 'cloud', 'dev'],
            'finance': ['bank', 'financial', 'invest', 'capital', 'fund'],
            'healthcare': ['health', 'medical', 'pharma', 'bio', 'care'],
            'retail': ['shop', 'store', 'retail', 'commerce', 'market'],
            'education': ['edu', 'university', 'school', 'academy', 'learn']
        }
        
        for industry, keywords in industry_keywords.items():
            if any(keyword in domain_lower for keyword in keywords):
                return industry.title()
        
        return ""
    
    def _infer_contact_type(self, title: str) -> str:
        """Infer contact type from title"""
        if not title:
            return ""
        
        title_lower = title.lower()
        
        if any(word in title_lower for word in ['recruit', 'talent']):
            return 'recruiter'
        elif any(word in title_lower for word in ['hr', 'human resources']):
            return 'hr'
        elif any(word in title_lower for word in ['hiring manager', 'manager']):
            return 'hiring_manager'
        else:
            return 'employee'